/**
 * Protected Route Component
 * Authentication disabled - all routes are accessible without auth
 */

import { Navigate } from "react-router-dom";
import { tokenStorage } from "../utils/storage";

const useAuth = () => {
  const token = tokenStorage.getToken();
  return !!token;
};

const ProtectedRoute = ({ children }) => {
  const isAuth = useAuth();
  return isAuth ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;

