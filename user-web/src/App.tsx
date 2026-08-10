import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { AuthProvider } from '@/contexts/AuthContext';
import { VideoProvider } from '@/contexts/VideoContext';
import { ModeProvider } from '@/contexts/ModeContext';
import AppDownloadBanner from '@/components/feature/AppDownloadBanner';

function App() {
  return (
    <AuthProvider>
      <ModeProvider>
        <VideoProvider>
          <BrowserRouter basename={__BASE_PATH__}>
            <AppRoutes />
            <AppDownloadBanner />
          </BrowserRouter>
        </VideoProvider>
      </ModeProvider>
    </AuthProvider>
  );
}

export default App;
