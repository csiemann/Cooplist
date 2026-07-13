import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';

export interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function checkRole(allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Implementação de verificação de role será adicionada após obter dados da playlist
    next();
  };
}
