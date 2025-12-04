import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Database, Wrench, DollarSign, GitCompare, TrendingUp, ListTodo, FileText, BookUser, Zap, ShieldCheck, LogOut, ChevronLeft, ChevronRight, User, Menu, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'quality', 'operator'], order: 1 },
    { icon: Wrench, label: 'WPS', path: '/wps-creator', roles: ['admin', 'quality'], order: 2 },
    { icon: DollarSign, label: 'Parça Maliyet', path: '/part-cost', roles: ['admin', 'quality', 'operator'], order: 3 },
    { icon: BookUser, label: 'Manuel Veri', path: '/manual-tracking', roles: ['admin', 'quality', 'operator'], order: 4 },
    { icon: GitCompare, label: 'Operasyon Azaltma', path: '/comparative', roles: ['admin', 'quality'], order: 5 },
    { icon: TrendingUp, label: 'Sürekli İyileştirme', path: '/improvement', roles: ['admin', 'quality'], order: 6 },
    { icon: Zap, label: 'Proje Bazlı İyileştirme', path: '/project-improvement', roles: ['admin', 'quality'], order: 7 },
    { icon: Settings, label: 'Fikstür İyileştirme', path: '/fixture-improvement', roles: ['admin', 'quality'], order: 8 },
    { icon: ListTodo, label: 'Aksiyon Takibi', path: '/tasks', roles: ['admin', 'quality', 'operator'], order: 9 },
    { icon: FileText, label: 'Eğitim Planı', path: '/trainings', roles: ['admin', 'quality', 'operator'], order: 10 },
    { icon: ShieldCheck, label: 'Denetim', path: '/audit', roles: ['admin'], order: 11 },
    { icon: Database, label: 'Ana Veri', path: '/master-data', roles: ['admin'], order: 12 },
];

const MainLayout = ({ children }) => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const currentLocation = useLocation();
    const userRole = user?.user_metadata?.role || 'operator';
    const userName = user?.user_metadata?.name || user?.email;
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const filteredNavItems = navItems
        .filter(item => item.roles.includes(userRole))
        .sort((a, b) => (a.order || 999) - (b.order || 999));

    const sidebarVariants = {
        open: { width: '280px', transition: { type: 'spring', stiffness: 300, damping: 30 } },
        closed: { width: '72px', transition: { type: 'spring', stiffness: 300, damping: 30 } },
    };

    const mobileSidebarVariants = {
        open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
        closed: { x: '-100%', transition: { type: 'spring', stiffness: 300, damping: 30 } },
    };

    const navLinkContent = (item) => (
        <div className="flex items-center w-full">
            <item.icon className={`h-5 w-5 flex-shrink-0 mr-4 opacity-80 group-hover:opacity-100 transition-opacity`} />
            <AnimatePresence>
                {(isSidebarOpen || isMobileMenuOpen) && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="whitespace-nowrap"
                    >
                        {item.label}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    );

    const sidebarContent = (
        <>
            <div className={`flex items-center p-5 border-b border-gray-800 h-[65px] ${isSidebarOpen || isMobileMenuOpen ? 'justify-start' : 'justify-center'}`}>
                {(isSidebarOpen || isMobileMenuOpen) && <span className="text-xl font-bold text-white">AYD <br />Kaynak Teknolojileri</span>}
            </div>
            <nav className="flex-1 py-3 overflow-y-auto">
                {filteredNavItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => 
                            `flex items-center px-5 py-3 mx-3 my-1 rounded-lg text-[15px] font-medium cursor-pointer transition-all duration-200 group ${
                                isActive 
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/30' 
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`
                        }
                        title={item.label}
                        onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
                    >
                        {navLinkContent(item)}
                    </NavLink>
                ))}
            </nav>
            <div className="mt-auto pt-4 pb-2 border-t border-gray-800 bg-gray-900">
                <div className={`flex items-center px-5 py-3 mx-3 my-1 rounded-lg text-gray-500 ${!isSidebarOpen && !isMobileMenuOpen ? 'justify-center' : ''}`}>
                    <User className="h-5 w-5 flex-shrink-0 mr-4" />
                    {(isSidebarOpen || isMobileMenuOpen) && (
                        <div>
                            <p className="text-sm font-semibold text-white">{userName}</p>
                            <p className="text-xs text-gray-400 capitalize">{userRole}</p>
                        </div>
                    )}
                </div>
                <button 
                    onClick={handleLogout} 
                    className="flex items-center px-5 py-3 mx-3 my-1 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-white w-[calc(100%-24px)] text-left group"
                >
                    <LogOut className="h-5 w-5 flex-shrink-0 mr-4 group-hover:text-red-500 transition-colors" />
                    {(isSidebarOpen || isMobileMenuOpen) && <span>Çıkış Yap</span>}
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Desktop Sidebar */}
            <motion.div
                variants={sidebarVariants}
                animate={isSidebarOpen ? 'open' : 'closed'}
                className="hidden md:flex flex-col bg-gray-900 text-white relative shadow-2xl"
            >
                {sidebarContent}
                <Button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                    className="absolute -right-4 top-8 z-10 h-8 w-8 rounded-full bg-gray-800 text-white hover:bg-indigo-500" 
                    size="icon"
                >
                    {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
            </motion.div>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 z-30 bg-black/60 md:hidden"
                        />
                        <motion.div
                            variants={mobileSidebarVariants}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            className="fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-gray-900 text-white shadow-lg w-72 md:hidden"
                        >
                            {sidebarContent}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow-sm flex items-center justify-between p-4 md:hidden h-[65px]">
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                        <Menu className="h-6 w-6" />
                    </Button>
                    <span className="text-xl font-bold">AYD WPS</span>
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                        <LogOut className="h-6 w-6 text-red-500" />
                    </Button>
                </header>
                
                <main className="flex-1 overflow-x-auto overflow-y-auto bg-gray-100 p-4 md:p-6 lg:p-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentLocation.pathname}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};
export default MainLayout;