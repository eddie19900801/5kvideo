import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import VideoDetail from "../pages/video/page";
import Profile from "../pages/profile/page";
import DownloadPage from "../pages/download/page";
import Recommend from "../pages/recommend/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/video/:id",
    element: <VideoDetail />,
  },
  {
    path: "/profile",
    element: <Profile />,
  },
  {
    path: "/favorites",
    element: <Profile initialTab="favorites" />,
  },
  {
    path: "/recommend",
    element: <Recommend />,
  },
  {
    path: "/download",
    element: <DownloadPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
