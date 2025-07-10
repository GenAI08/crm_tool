
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AuthModalProps {
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authMode: string;
  setAuthMode: (mode: string) => void;
  authEmailOrPhone: string;
  setAuthEmailOrPhone: (value: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  showAuthModal,
  setShowAuthModal,
  authMode,
  setAuthMode,
  authEmailOrPhone,
  setAuthEmailOrPhone
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for auth logic
    alert(`Attempting to ${authMode} with: ${authEmailOrPhone}`);
    setShowAuthModal(false);
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
      <DialogContent className="bg-slate-800 border-slate-600 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {authMode === 'login' ? 'Login' : 'Sign Up'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Email or Phone"
            className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
            value={authEmailOrPhone}
            onChange={(e) => setAuthEmailOrPhone(e.target.value)}
            required
          />
          
          <div className="flex space-x-2">
            <Button
              type="button"
              onClick={() => setAuthMode('login')}
              variant={authMode === 'login' ? 'default' : 'outline'}
              className="flex-1"
            >
              Login
            </Button>
            <Button
              type="button"
              onClick={() => setAuthMode('signup')}
              variant={authMode === 'signup' ? 'default' : 'outline'}
              className="flex-1"
            >
              Sign Up
            </Button>
          </div>
          
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            {authMode === 'login' ? 'Login' : 'Sign Up'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
