import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { Helmet } from 'react-helmet-async';
    import { Factory, Lock, LogIn, Mail } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useToast } from '@/components/ui/use-toast';
    import { useNavigate } from 'react-router-dom';
    
    const Login = () => {
      const [formData, setFormData] = useState({
        email: '',
        password: '',
      });
      const [loading, setLoading] = useState(false);
      const { signIn, signOut } = useAuth();
      const { toast } = useToast();
      const navigate = useNavigate();
    
      const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
    
        // Proactively sign out to clear any invalid session
        await signOut();
    
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          // The toast is already handled in the useAuth hook
        } else {
          toast({
            title: "Giriş Başarılı",
            description: "Hoş geldiniz!",
          });
          navigate('/dashboard');
        }
        setLoading(false);
      };
    
      return (
        <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
          <Helmet>
            <title>Giriş - AYD Kaynak Teknolojileri</title>
            <meta name="description" content="AYD Kaynak Teknolojileri Üretim Yönetim Sistemi'ne giriş yapın" />
          </Helmet>
    
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            <Card className="bg-black/20 backdrop-blur-lg border-white/20">
              <CardHeader className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mx-auto mb-4 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center"
                >
                  <Factory className="h-8 w-8 text-white" />
                </motion.div>
                <CardTitle className="text-2xl font-bold text-white">AYD Kaynak Teknolojileri</CardTitle>
                <CardDescription className="text-white/80">
                  Üretim Yönetim Sistemi'ne giriş yapın
                </CardDescription>
              </CardHeader>
    
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">E-posta</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="ornek@aydtr.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white"
                        required
                      />
                    </div>
                  </div>
    
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">Şifre</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Şifrenizi girin"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white"
                        required
                      />
                    </div>
                  </div>
    
                  <Button
                    type="submit"
                    className="w-full bg-white text-blue-600 hover:bg-white/90"
                    disabled={loading}
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Giriş Yap
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      );
    };
    
    export default Login;