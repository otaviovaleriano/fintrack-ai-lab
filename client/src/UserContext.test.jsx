import { act, render, screen, waitFor } from '@testing-library/react';
import { UserProvider, useUser } from './UserContext';
import { supabase } from './supabaseClient';

// Same rationale as App.test.js: mocked here so these tests never touch
// the real network, and configured inside each test body (not the
// factory) because CRA's default resetMocks: true wipes factory-level
// mock implementations before every test runs.
jest.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSession = {
  user: { id: 'user-1', email: 'jane@example.com' },
};

function mockProfileQuery(result) {
  supabase.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve(result),
      }),
    }),
  });
}

function Probe() {
  const { session, user, loading, profileError } = useUser();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="session">{session ? session.user.id : 'none'}</div>
      <div data-testid="user-name">{user ? user.name : 'none'}</div>
      <div data-testid="profile-error">{profileError ? 'error' : 'none'}</div>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <UserProvider>
      <Probe />
    </UserProvider>
  );
}

beforeEach(() => {
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
});

test('an authenticated session with a loaded profile exposes the profile name', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
  mockProfileQuery({ data: { name: 'Jane' }, error: null });

  renderWithProvider();

  // findByTestId only waits for the element to exist, not for its
  // content to change - the div is present from the first render, so
  // this must wait on the text content itself.
  await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('Jane'));
  expect(screen.getByTestId('session')).toHaveTextContent('user-1');
  expect(screen.getByTestId('profile-error')).toHaveTextContent('none');
});

test('a profile-fetch failure does not invalidate the session, and falls back to the email-derived name', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
  mockProfileQuery({ data: null, error: { message: 'boom' } });

  renderWithProvider();

  // The session/user must still resolve even though the profile fetch
  // failed - this is the specific contract called out in UserContext's
  // own comments, and the thing most likely to regress silently.
  await waitFor(() => expect(screen.getByTestId('profile-error')).toHaveTextContent('error'));
  expect(screen.getByTestId('session')).toHaveTextContent('user-1');
  expect(screen.getByTestId('user-name')).toHaveTextContent('jane');
});

test('loading is true until getSession resolves, then false with no session', async () => {
  let resolveSession;
  supabase.auth.getSession.mockReturnValue(
    new Promise((resolve) => {
      resolveSession = resolve;
    })
  );

  renderWithProvider();

  expect(screen.getByTestId('loading')).toHaveTextContent('true');

  resolveSession({ data: { session: null } });

  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  expect(screen.getByTestId('session')).toHaveTextContent('none');
  expect(screen.getByTestId('user-name')).toHaveTextContent('none');
});

test('onAuthStateChange updates the session without a page reload', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

  let authChangeCallback;
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authChangeCallback = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  mockProfileQuery({ data: { name: 'Jane' }, error: null });

  renderWithProvider();

  await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('none'));

  act(() => {
    authChangeCallback('SIGNED_IN', mockSession);
  });

  await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('user-1'));
});

test('logout calls supabase.auth.signOut', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
  mockProfileQuery({ data: { name: 'Jane' }, error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });

  let logoutFn;
  function LogoutProbe() {
    const { logout } = useUser();
    logoutFn = logout;
    return null;
  }

  render(
    <UserProvider>
      <LogoutProbe />
    </UserProvider>
  );

  await waitFor(() => expect(logoutFn).toBeDefined());
  await logoutFn();

  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});
