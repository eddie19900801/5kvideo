import type { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

const NotFound = lazy(() => import('@/pages/NotFound'));
const Home = lazy(() => import('@/pages/home/page'));
const VideoPlayer = lazy(() => import('@/pages/video/page'));
const Favorites = lazy(() => import('@/pages/favorites/page'));
const Profile = lazy(() => import('@/pages/profile/page'));
const Login = lazy(() => import('@/pages/login/page'));
const History = lazy(() => import('@/pages/history/page'));
const Recommend = lazy(() => import('@/pages/recommend/page'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/video/:id',
    element: <VideoPlayer />,
  },
  {
    path: '/favorites',
    element: <Favorites />,
  },
  {
    path: '/profile',
    element: <Profile />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/history',
    element: <History />,
  },
  {
    path: '/recommend',
    element: <Recommend />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
