interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className = "", title }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <h2 className="text-tagline font-semibold text-headline mb-4">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
