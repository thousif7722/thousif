import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BookOpen, Heart, User } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectUser } from '@/store/slices/authSlice';

export default function BottomNavigation() {
  const user = useSelector(selectUser);
  const isCustomer = user?.role === 'customer' || !user;

  if (!isCustomer) return null; // Only for customers currently; providers could have their own

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/bookings', label: 'Bookings', icon: BookOpen },
    { to: '/saved', label: 'Saved', icon: Heart },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <>
      {/* Spacer to prevent content from hiding behind fixed nav */}
      <div className="h-16 md:hidden"></div>
      
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 md:hidden pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item, idx) => (
            <NavLink
              key={idx}
              to={item.to}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon 
                    size={24} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={isActive ? 'transform scale-110' : ''} 
                    style={{ transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                  />
                  <span className={`text-[10px] font-semibold ${isActive ? 'font-bold' : ''}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}
