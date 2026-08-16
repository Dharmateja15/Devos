import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: any) {
    const { email, username, password, displayName } = data;
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw new ConflictException('Identity already in use');
    }

    const passwordHash = await argon2.hash(password);

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        displayName: displayName || username,
        passwordHash,
      },
    });

    return this.createSession(user.id);
  }

  async login(data: any) {
    const { identity, password } = data;
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identity }, { username: identity }] },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await argon2.verify(user.passwordHash, password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSession(user.id);
  }

  private async createSession(userId: string) {
    const payload = { sub: userId };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: `${session.id}:${refreshToken}`,
    };
  }

  async refresh(oldRefreshToken: string) {
    if (!oldRefreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    // Since we only have the plaintext refresh token from the cookie, we need to find all sessions
    // or just assume we don't have the user ID. But usually we need the user ID or session ID in the cookie too.
    // Alternatively, we can just search through valid sessions. But bcrypt.compare cannot be used for searching.
    // Let's modify the refresh token to include the session ID: "sessionId:randomBytes"
    const parts = oldRefreshToken.split(':');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid refresh token format');
    }
    const [sessionId, tokenValue] = parts;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      throw new UnauthorizedException('Session expired');
    }

    const isMatch = await bcrypt.compare(tokenValue, session.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate refresh token
    const newRefreshTokenValue = randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshTokenValue, salt);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt,
        lastActiveAt: new Date(),
      },
    });

    const accessToken = this.jwtService.sign({ sub: session.userId });

    return {
      accessToken,
      refreshToken: `${sessionId}:${newRefreshTokenValue}`,
    };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    const parts = refreshToken.split(':');
    if (parts.length === 2) {
      const sessionId = parts[0];
      await this.prisma.session
        .delete({ where: { id: sessionId } })
        .catch(() => {});
    }
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, role: true },
    });
  }

  async getUserStats(userId: string) {
    const xpEntry = await this.prisma.xpLedger.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const streak = await this.prisma.streak.findFirst({
      where: { userId },
    });

    const achievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });

    return {
      xp: xpEntry?.balanceAfter || 0,
      streak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      achievements: achievements.map((a) => a.achievement),
    };
  }
}
