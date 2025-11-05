import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    
    const AuthContext = createContext(undefined);
    
    export const AuthProvider = ({ children }) => {
      const { toast } = useToast();
    
      const [user, setUser] = useState(null);
      const [session, setSession] = useState(null);
      const [loading, setLoading] = useState(true);
    
      const clearLocalState = useCallback(() => {
        setUser(null);
        setSession(null);
        Object.keys(localStorage)
          .filter(key => key.startsWith('sb-'))
          .forEach(key => localStorage.removeItem(key));
      }, []);
    
      const handleSession = useCallback((currentSession) => {
        if (!currentSession) {
          clearLocalState();
          setLoading(false);
          return;
        }
    
        setSession(currentSession);
        setUser(currentSession.user);
        setLoading(false);
      }, [clearLocalState]);
    
      useEffect(() => {
        const getSession = async () => {
          try {
            const { data: { session: currentSession }, error } = await supabase.auth.getSession();
            if (error) {
              if (error.message.includes("Invalid Refresh Token")) {
                console.warn("Invalid refresh token found. Clearing session.");
                await supabase.auth.signOut();
                clearLocalState();
              } else {
                throw error;
              }
            }
            handleSession(currentSession);
          } catch (error) {
            console.error("Error getting session:", error);
            clearLocalState();
            setLoading(false);
          }
        };
    
        getSession();
    
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, currentSession) => {
            if (_event === 'SIGNED_OUT') {
              clearLocalState();
            } else if (_event === 'TOKEN_REFRESHED' || _event === 'SIGNED_IN') {
              handleSession(currentSession);
            } else if (_event === 'USER_DELETED') {
              clearLocalState();
            }
          }
        );
    
        return () => subscription.unsubscribe();
      }, [handleSession, clearLocalState]);
    
      const signUp = useCallback(async (email, password, metadata) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
          },
        });
    
        if (error) {
          toast({
            variant: "destructive",
            title: "Kayıt Başarısız",
            description: error.message || "Bir şeyler ters gitti.",
          });
        }
    
        return { data, error };
      }, [toast]);
    
      const signIn = useCallback(async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
    
        if (error) {
          console.error("Sign in error:", error);
          if (error.message !== "Email not confirmed") {
            toast({
              variant: "destructive",
              title: "Giriş Başarısız",
              description: error.message === 'Invalid login credentials' 
                ? 'E-posta veya şifre hatalı!' 
                : error.message,
            });
          }
        }
        
        return { data, error };
      }, [toast]);
    
      const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        clearLocalState();
    
        if (error) {
          toast({
            variant: "destructive",
            title: "Çıkış Başarısız",
            description: error.message || "Bir şeyler ters gitti.",
          });
        }
    
        return { error };
      }, [toast, clearLocalState]);
    
      const value = useMemo(() => ({
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
      }), [user, session, loading, signUp, signIn, signOut]);
    
      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    };
    
    export const useAuth = () => {
      const context = useContext(AuthContext);
      if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
      }
      return context;
    };