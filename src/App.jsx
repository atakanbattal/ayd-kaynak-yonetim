import React from 'react';
    import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
    import { Helmet } from 'react-helmet-async';
    import { motion } from 'framer-motion';
    import { Toaster } from '@/components/ui/toaster';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    
    import Login from '@/components/Login';
    import MainLayout from '@/components/MainLayout';
    import Dashboard from '@/components/Dashboard';
    import MasterData from '@/components/MasterData';
    import WPSCreator from '@/components/WPSCreator';
    import PartCost from '@/components/PartCost';
    import ComparativeCost from '@/components/ComparativeCost';
    import ContinuousImprovement from '@/components/ContinuousImprovement';
    import TaskManager from '@/components/TaskManager';
    import AuditLog from '@/components/AuditLog';
    import PrintPage from '@/components/PrintPage';
    import TrainingPlan from '@/components/TrainingPlan';
    import TrainingDetail from '@/components/TrainingDetail';
    import ProjectImprovement from '@/components/ProjectImprovement';
    import ManualDataTracking from '@/components/ManualDataTracking';
    import FixtureImprovement from '@/components/FixtureImprovement';

    class ErrorBoundary extends React.Component {
        constructor(props) {
            super(props);
            this.state = { hasError: false, error: null };
        }

        static getDerivedStateFromError(error) {
            return { hasError: true, error };
        }

        componentDidCatch(error, errorInfo) {
            console.error('Error caught by boundary:', error, errorInfo);
        }

        render() {
            if (this.state.hasError) {
                return (
                    <div className="min-h-screen flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-red-600 mb-4">Bir Hata Oluştu</h1>
                            <p className="text-gray-600 mb-4">{this.state.error?.message || 'Beklenmeyen bir hata oluştu'}</p>
                            <button 
                                onClick={() => window.location.reload()} 
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                                Sayfayı Yenile
                            </button>
                        </div>
                    </div>
                );
            }

            return this.props.children;
        }
    }
    
    const ProtectedRoute = () => {
      const { user, loading } = useAuth();
    
      if (loading) {
        return (
          <div className="min-h-screen gradient-bg flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"
            />
          </div>
        );
      }
    
      if (!user) {
        return <Navigate to="/login" replace />;
      }
    
      return <Outlet />;
    };
    
    function App() {
      const { user } = useAuth();
      const userRole = user?.user_metadata?.role || 'operator';
      const userName = user?.user_metadata?.name || user?.email;
    
      const adminRoutes = [
        { path: 'master-data', element: <MasterData /> },
        { path: 'audit', element: <AuditLog /> },
      ];
    
      const qualityRoutes = [
        { path: 'wps-creator', element: <WPSCreator /> },
        { path: 'comparative', element: <ComparativeCost /> },
        { path: 'improvement', element: <ContinuousImprovement /> },
        { path: 'project-improvement', element: <ProjectImprovement /> },
        { path: 'fixture-improvement', element: <FixtureImprovement /> },
      ];
    
      const operatorRoutes = [
        { path: 'part-cost', element: <PartCost /> },
        { path: 'trainings', element: <TrainingPlan /> },
        { path: 'trainings/:trainingId', element: <TrainingDetail /> },
        { path: 'manual-tracking', element: <ManualDataTracking /> },
      ];
    
      const commonRoutes = [
        { path: 'dashboard', element: <Dashboard user={{ name: userName, role: userRole }} /> },
        { path: 'tasks', element: <TaskManager user={{ name: userName, role: userRole }} /> },
      ];
    
      const getAccessibleRoutes = () => {
        if (!user) return [];
        let routes = [...commonRoutes];
        if (userRole === 'admin') {
          routes = [...routes, ...adminRoutes, ...qualityRoutes, ...operatorRoutes];
        } else if (userRole === 'quality') {
          routes = [...routes, ...qualityRoutes, ...operatorRoutes];
        } else if (userRole === 'operator') {
          routes = [...routes, ...operatorRoutes];
        }
        return routes;
      };
    
      return (
        <ErrorBoundary>
          <Helmet>
            <title>AYD Kaynak Teknolojileri - Üretim Yönetim Sistemi</title>
            <meta name="description" content="WPS, Maliyet Analizi ve Üretim İzlenebilirlik için entegre kurumsal çözüm" />
            <link rel="preconnect" href="https://rsms.me/" />
            <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
            <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet" />
          </Helmet>
          
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/print" element={<PrintPage />} />
            <Route element={<ProtectedRoute />}>
              <Route 
                path="/*"
                element={
                  <MainLayout>
                    <Routes>
                      {getAccessibleRoutes().map(route => (
                        <Route key={route.path} path={route.path} element={route.element} />
                      ))}
                      <Route path="" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </MainLayout>
                }
              />
            </Route>
          </Routes>
          
          <Toaster />
        </ErrorBoundary>
      );
    }
    
    export default App;