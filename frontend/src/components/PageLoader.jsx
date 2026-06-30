const PageLoader = ({ label = 'Loading...' }) => {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader-spinner" aria-hidden="true" />
      <p className="page-loader-label">{label}</p>
    </div>
  );
};

export default PageLoader;