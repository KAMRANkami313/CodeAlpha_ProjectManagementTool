import { useState, useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Lock,
  Save,
  Check,
  Sun,
  Moon,
  Bell,
  Eye,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { api } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

const Settings = () => {
  const { user, logout } = useContext(AuthContext);
  const { emailNotifications, compactView, updateEmailNotifications, updateCompactView, updateTheme, themePreference } = usePreferences();

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await api.get('/users/profile');
        setName(profile.name || '');
        setBio(profile.bio || '');
        setAvatar(profile.avatar || '');
      } catch (err) {
        setProfileError(err.message || 'Failed to load profile');
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess(false);
    try {
      await api.put('/users/profile', { name, bio, avatar });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/users/password', { currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        logout();
      }, 2500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link to="/" className="board-back-link" aria-label="Back to dashboard">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="settings-title">Settings</h1>
      </header>

      <div className="settings-container">
        <section className="settings-card">
          <div className="settings-card-header">
            <UserIcon size={18} />
            <h2>Profile</h2>
          </div>

          {profileError && <div className="auth-error settings-error">{profileError}</div>}
          {profileSuccess && (
            <div className="settings-success">
              <Check size={14} /> Profile saved successfully
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="settings-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={profileLoading || savingProfile}
                required
                minLength={2}
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email (read-only)</label>
              <div className="settings-readonly-input">
                <Mail size={14} />
                <span>{user?.email}</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                rows="3"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={profileLoading || savingProfile}
                maxLength={300}
                placeholder="Tell your team a bit about yourself…"
              />
              <span className="settings-char-count">{bio.length}/300</span>
            </div>

            <div className="form-group">
              <label htmlFor="avatar">Avatar URL</label>
              <input
                id="avatar"
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                disabled={profileLoading || savingProfile}
                placeholder="https://…"
              />
            </div>

            <button type="submit" className="auth-btn settings-save-btn" disabled={savingProfile || profileLoading}>
              <Save size={16} />
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            {themePreference === 'light' ? <Sun size={18} /> : <Moon size={18} />}
            <h2>Appearance</h2>
          </div>

          <div className="settings-section">
            <p className="settings-section-label">Theme</p>
            <p className="settings-section-hint">Choose how CollabTask looks to you. System follows your OS preference.</p>
            <ThemeToggle variant="cycle" />
          </div>

          <div className="settings-section">
            <div className="settings-toggle-row">
              <div className="settings-toggle-info">
                <Eye size={16} />
                <div>
                  <p className="settings-toggle-label">Compact view</p>
                  <p className="settings-toggle-hint">Reduce padding on task cards to fit more on screen.</p>
                </div>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={compactView}
                  onChange={(e) => updateCompactView(e.target.checked)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <Bell size={18} />
            <h2>Notifications</h2>
          </div>

          <div className="settings-section">
            <div className="settings-toggle-row">
              <div className="settings-toggle-info">
                <Bell size={16} />
                <div>
                  <p className="settings-toggle-label">Email notifications</p>
                  <p className="settings-toggle-hint">Receive email alerts when you're assigned tasks or mentioned in comments.</p>
                </div>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => updateEmailNotifications(e.target.checked)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <Lock size={18} />
            <h2>Change Password</h2>
          </div>

          {passwordError && <div className="auth-error settings-error">{passwordError}</div>}
          {passwordSuccess && (
            <div className="settings-success">
              <Check size={14} /> Password changed. All sessions revoked — redirecting to login…
            </div>
          )}

          <form onSubmit={handleChangePassword} className="settings-form">
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={savingPassword}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={savingPassword}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={savingPassword}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="settings-notice">
              <AlertCircle size={14} />
              <span>Changing your password revokes all active sessions on every device.</span>
            </div>

            <button type="submit" className="auth-btn settings-save-btn" disabled={savingPassword}>
              <Shield size={16} />
              {savingPassword ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Settings;