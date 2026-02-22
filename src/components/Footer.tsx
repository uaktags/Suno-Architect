interface FooterProps {
  git: string;
}

const Footer = ({ git }: FooterProps) => {
  return (
    <footer className="w-full py-6 text-center border-t border-[var(--app-panel-border)] bg-[var(--app-panel)] backdrop-blur-sm">
      <p className="text-slate-500 text-sm">
        Open Source Project. View source on{' '}
        <a 
          href={git} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[var(--app-accent)] hover:text-[var(--app-accent)] hover:underline transition-colors font-medium"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
};

export default Footer;