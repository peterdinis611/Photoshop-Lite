import { Toaster } from 'sonner';

/** Sonner host — industrial darkroom chrome, bottom-right above the status bar. */
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      closeButton
      richColors={false}
      expand={false}
      visibleToasts={4}
      gap={10}
      offset={{ bottom: 48, right: 16 }}
      mobileOffset={{ bottom: 56, right: 12 }}
      toastOptions={{
        className: 'pl-toast',
        classNames: {
          toast: 'pl-toast',
          title: 'pl-toast__title',
          description: 'pl-toast__desc',
          closeButton: 'pl-toast__close',
          success: 'pl-toast--success',
          error: 'pl-toast--error',
          loading: 'pl-toast--loading',
          info: 'pl-toast--info',
        },
      }}
    />
  );
}
