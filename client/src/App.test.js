import { render, screen } from '@testing-library/react';
import App from './App';
import { supabase } from './supabaseClient';

// UserContext calls supabase.auth.getSession()/onAuthStateChange() on
// mount. Mocked here so this test never touches the real network - no
// live Supabase project, credentials, or CI secrets required.
//
// Mock implementations are configured inside the test itself, not in
// this factory: CRA's default Jest config sets resetMocks: true, which
// resets mock functions to their bare no-op state before every test -
// a .mockResolvedValue() set here at module-load time would be wiped
// before the test body runs.
jest.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

test('an unauthenticated visitor resolves to the login experience', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });

  render(<App />);

  // ProtectedRoute renders nothing while the (mocked) session check is
  // in flight, then redirects once it resolves to no session - this
  // await is what actually exercises that resolution, not just a
  // static render.
  expect(await screen.findByText(/welcome to fintrack/i)).toBeInTheDocument();
});
