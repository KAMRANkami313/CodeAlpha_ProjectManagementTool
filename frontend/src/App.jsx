import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';

const ProtectedRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/login" replace />;
};

const GuestRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return !user ? children : <Navigate to="/" replace />;
};

const DashboardPlaceholder = () => {
  const { logout, user } = useContext(AuthContext);
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Dashboard (Placeholder)</h1>
      <p>Logged in as: {user?.name}</p>
      <button 
        onClick={logout} 
        style={{ 
          marginTop: '20px', 
          backgroundColor: '#ef4444', 
          color: '#ffffff', 
          padding: '8px 16px', 
          borderRadius: '4px' 
        }}
      >
        Sign Out
      </button>
    </div>
  );
};

const BoardPlaceholder = () => {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Project Board (Placeholder)</h1>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:projectId"
          element={
            <ProtectedRoute>
              <BoardPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestRoute>
              <Signup />
            </GuestRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;