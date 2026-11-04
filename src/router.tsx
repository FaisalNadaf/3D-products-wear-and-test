import { createBrowserRouter } from 'react-router';
import { PageLoader, SiteLayout } from './components/site/SiteLayout';
import { NotFound } from './pages/NotFound';

// each experience is code-split; its 3D engine loads only when the route is visited
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SiteLayout />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { index: true, lazy: page(() => import('./pages/Home')) },
      { path: 'jewellery', lazy: page(() => import('./pages/JewelleryStudio')) },
      { path: 'watches', lazy: page(() => import('./pages/Watches')) },
      { path: 'tshirt', lazy: page(() => import('./pages/TShirtStudio')) },
      { path: 'curtains', lazy: page(() => import('./pages/CurtainVisualizer')) },
      { path: 'about', lazy: page(() => import('./pages/About')) },
      { path: 'contact', lazy: page(() => import('./pages/Contact')) },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
