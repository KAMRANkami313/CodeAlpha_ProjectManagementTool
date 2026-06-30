import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const ReconnectionBanner = () => {
  const { socket, isConnected } = useSocket();
  const [visible, setVisible] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = () => setVisible(true);
    const handleConnect = () => {
      setVisible(false);
      setRetrying(false);
    };
    const handleReconnectAttempt = () => setRetrying(true);

    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);

    if (!socket.connected) {
      setVisible(true);
    }

    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
    };
  }, [socket]);

  if (!visible) return null;

  const handleManualRetry = () => {
    if (socket) {
      socket.connect();
    }
  };

  return (
    <div className="reconnection-banner" role="alert" aria-live="assertive">
      <div className="reconnection-banner-content">
        <WifiOff size={18} className="reconnection-banner-icon" />
        <span className="reconnection-banner-text">
          {retrying ? 'Reconnecting...' : 'Connection lost. Real-time updates paused.'}
        </span>
        {!retrying && (
          <button
            className="reconnection-banner-btn"
            onClick={handleManualRetry}
            aria-label="Retry connection"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default ReconnectionBanner;