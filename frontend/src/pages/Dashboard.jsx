import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import CreateProjectModal from '../components/CreateProjectModal';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import { Kanban, Folder, Plus, LogOut, User, Calendar, Settings as SettingsIcon } from 'lucide-react';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user, logout } = useContext(AuthContext);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await api.get('/projects');
        setProjects(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch projects');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleProjectCreated = (newProject) => {
    setProjects((prev) => [newProject, ...prev]);
    setShowModal(false);
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <Kanban size={24} />
            <span>CollabTask</span>
          </div>

          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-email">{user?.email}</span>
            </div>
          </div>
        </div>

        <div className="sidebar-bottom">
          <Link to="/settings" className="settings-link-btn" title="Settings">
            <SettingsIcon size={18} />
            <span>Settings</span>
          </Link>
          <ThemeToggle variant="simple" />
        </div>

        <button className="logout-btn" onClick={logout}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <h1 className="main-title">My Workspaces</h1>
          <div className="main-header-actions">
            <NotificationBell />
            <button className="create-project-btn" onClick={() => setShowModal(true)}>
              <Plus size={18} />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {error && <div className="auth-error main-error-block">{error}</div>}

        {loading ? (
          <div className="state-message">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <Folder size={48} className="empty-state-icon" />
            <h3>No projects found</h3>
            <p className="empty-state-text">Get started by creating your first collaborative workspace project board.</p>
            <button className="create-project-btn empty-state-btn" onClick={() => setShowModal(true)}>
              <Plus size={18} />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <Link to={`/project/${project._id}`} key={project._id} className="project-card animate-fade-in">
                <div>
                  <div className="project-card-header">
                    <h3 className="project-card-title">{project.name}</h3>
                    <Folder size={18} className="project-card-icon" />
                  </div>
                  <p className="project-card-description">{project.description || 'No description provided.'}</p>
                </div>
                <div className="project-card-footer">
                  <div className="project-owner-info">
                    <User size={12} />
                    <span>Owner: {project.owner?.name === user?.name ? 'Me' : project.owner?.name}</span>
                  </div>
                  <div className="project-card-date">
                    <Calendar size={12} />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}
    </div>
  );
};

export default Dashboard;
