import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthProvider } from '@prisma/client';

export function isValidHttpUrl(urlString: string): boolean {
  if (typeof urlString !== 'string' || !urlString.trim()) return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/me/settings
   * Returns current user's account details, public profile configuration, and GitHub connection status.
   */
  async getSettings(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const publicProfile = await this.prisma.publicProfile.findUnique({
      where: { userId },
    });

    const githubAccount = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider: AuthProvider.GITHUB },
    });

    return {
      account: {
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
      profile: {
        isPublic: publicProfile ? publicProfile.isPublic : false,
        headline: publicProfile ? publicProfile.headline : null,
        bio: publicProfile ? publicProfile.bio : null,
        socialLinks:
          (publicProfile?.socialLinks as Record<string, string>) || {},
      },
      github: {
        connected: !!githubAccount,
      },
    };
  }

  /**
   * PATCH /api/v1/me/account
   * Updates authenticated user's account settings (displayName, username, avatarUrl).
   * Strict allowlist: ONLY displayName, username, avatarUrl allowed.
   */
  async updateAccount(userId: string, body: any) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Invalid payload body');
    }

    const allowedAccountKeys = new Set([
      'displayName',
      'username',
      'avatarUrl',
    ]);
    const keys = Object.keys(body);

    if (keys.length === 0) {
      throw new BadRequestException(
        'At least one field must be provided to update',
      );
    }

    for (const key of keys) {
      if (!allowedAccountKeys.has(key)) {
        throw new BadRequestException(
          `Field '${key}' is not allowed in account settings update`,
        );
      }
    }

    const dataToUpdate: any = {};

    // Validate displayName if provided
    if ('displayName' in body) {
      if (typeof body.displayName !== 'string' || !body.displayName.trim()) {
        throw new BadRequestException('Display name cannot be empty');
      }
      dataToUpdate.displayName = body.displayName.trim();
    }

    // Validate username if provided
    if ('username' in body) {
      if (typeof body.username !== 'string' || !body.username.trim()) {
        throw new BadRequestException('Username cannot be empty');
      }
      const cleanUsername = body.username.trim().toLowerCase();

      // Check username uniqueness excluding current user
      const existing = await this.prisma.user.findFirst({
        where: {
          username: { equals: cleanUsername, mode: 'insensitive' },
          id: { not: userId },
        },
      });

      if (existing) {
        throw new ConflictException('Username is already taken');
      }

      dataToUpdate.username = cleanUsername;
    }

    // Validate avatarUrl if provided
    if ('avatarUrl' in body) {
      if (body.avatarUrl !== null && typeof body.avatarUrl !== 'string') {
        throw new BadRequestException('Avatar URL must be a string or null');
      }
      dataToUpdate.avatarUrl = body.avatarUrl ? body.avatarUrl.trim() : null;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        displayName: true,
        username: true,
        avatarUrl: true,
      },
    });

    return {
      account: {
        displayName: updatedUser.displayName,
        username: updatedUser.username,
        avatarUrl: updatedUser.avatarUrl,
      },
    };
  }

  /**
   * PATCH /api/v1/me/profile
   * Updates authenticated user's public profile settings (isPublic, headline, bio, socialLinks).
   * Strict allowlist: ONLY isPublic, headline, bio, socialLinks allowed.
   */
  async updateProfile(userId: string, body: any) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Invalid payload body');
    }

    const allowedProfileKeys = new Set([
      'isPublic',
      'headline',
      'bio',
      'socialLinks',
    ]);
    const keys = Object.keys(body);

    if (keys.length === 0) {
      throw new BadRequestException(
        'At least one field must be provided to update',
      );
    }

    for (const key of keys) {
      if (!allowedProfileKeys.has(key)) {
        throw new BadRequestException(
          `Field '${key}' is not allowed in profile settings update`,
        );
      }
    }

    const dataToUpdate: any = {};

    if ('isPublic' in body) {
      if (typeof body.isPublic !== 'boolean') {
        throw new BadRequestException('isPublic must be a boolean');
      }
      dataToUpdate.isPublic = body.isPublic;
    }

    if ('headline' in body) {
      if (body.headline !== null && typeof body.headline !== 'string') {
        throw new BadRequestException('Headline must be a string or null');
      }
      dataToUpdate.headline = body.headline ? body.headline.trim() : null;
    }

    if ('bio' in body) {
      if (body.bio !== null && typeof body.bio !== 'string') {
        throw new BadRequestException('Bio must be a string or null');
      }
      dataToUpdate.bio = body.bio ? body.bio.trim() : null;
    }

    if ('socialLinks' in body) {
      if (
        typeof body.socialLinks !== 'object' ||
        body.socialLinks === null ||
        Array.isArray(body.socialLinks)
      ) {
        throw new BadRequestException(
          'socialLinks must be a key-value object of strings',
        );
      }

      for (const [k, v] of Object.entries(body.socialLinks)) {
        if (typeof k !== 'string' || typeof v !== 'string') {
          throw new BadRequestException(
            'socialLinks entries must be string key-value pairs',
          );
        }
        if (!isValidHttpUrl(v)) {
          throw new BadRequestException(
            `Invalid social URL '${v}' for key '${k}'. Social links must be valid HTTP or HTTPS URLs.`,
          );
        }
      }
      dataToUpdate.socialLinks = body.socialLinks;
    }

    // Upsert PublicProfile for authenticated user
    const updatedProfile = await this.prisma.publicProfile.upsert({
      where: { userId },
      update: dataToUpdate,
      create: {
        userId,
        isPublic: dataToUpdate.isPublic ?? false,
        headline: dataToUpdate.headline ?? null,
        bio: dataToUpdate.bio ?? null,
        socialLinks: dataToUpdate.socialLinks ?? {},
      },
    });

    return {
      profile: {
        isPublic: updatedProfile.isPublic,
        headline: updatedProfile.headline,
        bio: updatedProfile.bio,
        socialLinks:
          (updatedProfile.socialLinks as Record<string, string>) || {},
      },
    };
  }

  /**
   * DELETE /api/v1/me/github
   * Disconnects current user's GitHub OAuthAccount. Idempotent: returns success even if already disconnected.
   */
  async disconnectGithub(userId: string) {
    await this.prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider: AuthProvider.GITHUB,
      },
    });

    return { success: true };
  }
}
