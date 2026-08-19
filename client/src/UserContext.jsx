import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const UserContext = createContext();

// Same fallback convention as the Phase 2 signup trigger (coalesce to
// the email prefix), applied here for the case where a profile row
// can't be loaded.
function deriveNameFromEmail(email) {
  return email ? email.split('@')[0] : undefined;
}

export const UserProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Session discovery + auth change listener. Deliberately synchronous:
  // no Supabase calls happen inside onAuthStateChange itself - it only
  // ever calls setSession. Async work (the profile fetch) lives in its
  // own effect below, reacting to the resulting state change instead.
  // This avoids the documented supabase-js deadlock risk from awaiting
  // Supabase calls directly inside this callback.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Profile fetch: reacts to the authenticated user id changing, kept
  // fully separate from the auth listener above.
  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    let cancelled = false;
    setProfileError(null);

    supabase
      .from('profiles')
      .select()
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // A profile-fetch failure must not invalidate a valid
          // authenticated session - `user` below still resolves via
          // the email-derived fallback name.
          console.error('Failed to fetch profile:', error);
          setProfileError(error);
          setProfile(null);
        } else {
          setProfile(data);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const logout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange fires SIGNED_OUT -> session becomes null -> the
    // profile effect above clears profile/profileError on its own.
  };

  const user = session?.user
    ? { ...session.user, name: profile?.name ?? deriveNameFromEmail(session.user.email) }
    : null;

  return (
    <UserContext.Provider value={{ session, user, loading, profileError, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
