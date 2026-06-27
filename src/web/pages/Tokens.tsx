import { Navigate } from "react-router-dom";

export default function Tokens() {
  return <Navigate to="/accounts?segment=apikey" replace />;
}
