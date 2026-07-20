import { useEffect, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

const ClientOnly = ({ children, fallback = null }: Props) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return fallback;

  return children;
};

export default ClientOnly;
