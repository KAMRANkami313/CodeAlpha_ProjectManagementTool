import { useState, useRef } from 'react';
import { X, UserPlus, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import useModal from '../hooks/useModal';

const MembersModal = ({ project, currentUser, onClose, onMembersUpdated }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const isOwner = project.owner._id === currentUser?._id;

  useModal(true, onClose, containerRef);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const updatedProject = await api.post(`/projects/${project._id}/members`, { email });
      onMembersUpdated(updatedProject);
      setEmail('');
    } catch (err) {
      setError(err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId) => {
    if (!window.confirm('Remove this member from the project?')) return;
    try {
      await api.delete(`/projects/${project._id}/members`, { userId });
      onMembersUpdated({
        ...project,
        members: project.members.filter((m) => m._id !== userId),
      });
    } catch (err) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={handleOverlayClick}>
      <div
        className="modal-container"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-modal-title"
      >
        <div className="modal-header">
          <h3 className="modal-title" id="members-modal-title">Project Members</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && <div className="auth-error modal-error-block">{error}</div>}

        <div className="member-list">
          {project.members.map((member) => (
            <div className="member-row" key={member._id}>
              <div className="member-info">
                <div className="sidebar-user-avatar member-avatar-sm">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="member-name">
                    {member.name}
                    {member._id === project.owner._id && <span className="owner-tag">Owner</span>}
                  </div>
                  <div className="member-email">{member.email}</div>
                </div>
              </div>
              {isOwner && member._id !== project.owner._id && (
                <button
                  className="icon-btn-danger"
                  onClick={() => handleRemove(member._id)}
                  aria-label={`Remove ${member.name}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {isOwner && (
          <form className="invite-form" onSubmit={handleInvite}>
            <input
              type="email"
              placeholder="Invite by email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="auth-btn modal-submit-btn" type="submit" disabled={loading}>
              <UserPlus size={16} />
              {loading ? 'Adding...' : 'Add'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default MembersModal;
