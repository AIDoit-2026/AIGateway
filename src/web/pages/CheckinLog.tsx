import { Navigate } from "react-router-dom";

export default function CheckinLog() {
  return <Navigate to="/accounts?segment=apikey" replace />;
}
