import { Navigate } from "react-router-dom";

export default function OAuthManagement() {
  return <Navigate to="/accounts?segment=apikey" replace />;
}
