import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';

interface DialogConfig {
  type: 'alert' | 'confirm';
  title?: string;
  message: string;
  resolve: (value: boolean) => void;
}

interface DialogContextProps {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  const alert = (message: string, title = 'Notification') => {
    return new Promise<void>((resolve) => {
      setDialog({
        type: 'alert',
        title,
        message,
        resolve: () => {
          setDialog(null);
          resolve();
        },
      });
    });
  };

  const confirm = (message: string, title = 'Confirm Action') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: 'confirm',
        title,
        message,
        resolve: (result) => {
          setDialog(null);
          resolve(result);
        },
      });
    });
  };

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      {dialog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop (no click event to close, user must explicitly interact with buttons) */}
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
          
          {/* Card Container */}
          <div className="max-w-md w-full bg-white/95 backdrop-blur-md relative z-10 space-y-5 shadow-2xl border border-slate-200/60 p-6 rounded-2xl animate-in zoom-in-95 duration-150">
            {/* Body */}
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                dialog.type === 'confirm' 
                  ? 'bg-amber-50 text-warning-orange border border-warning-orange/10' 
                  : 'bg-brand-blue-light text-brand-blue border border-brand-blue/10'
              }`}>
                {dialog.type === 'confirm' ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : (
                  <Info className="h-6 w-6" />
                )}
              </div>
              <div className="space-y-1.5 flex-grow min-w-0">
                <h3 className="font-display font-bold text-base text-slate-900">
                  {dialog.title}
                </h3>
                <p className="text-slate-600 text-xs font-sans leading-relaxed whitespace-pre-wrap break-words">
                  {dialog.message}
                </p>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-2 flex justify-end gap-3 font-sans text-xs">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => dialog.resolve(false)}
                    className="uipro-button uipro-button-secondary !py-2.5 !px-5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => dialog.resolve(true)}
                    className="uipro-button !bg-danger-red hover:!bg-danger-red/90 text-white !py-2.5 !px-5 shadow-sm"
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => dialog.resolve(true)}
                  className="uipro-button uipro-button-secondary !py-2.5 !px-5"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
