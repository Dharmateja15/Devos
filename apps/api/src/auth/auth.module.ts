import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import * as fs from 'fs';

let privateKey = process.env.JWT_PRIVATE_KEY || 'test';
let publicKey = process.env.JWT_PUBLIC_KEY || 'test';

if (privateKey === 'test' && fs.existsSync('../../.env')) {
  // Mock fallback logic if env vars not fully loaded in some tests
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      privateKey: process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      publicKey: process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n'),
      signOptions: { 
        expiresIn: '15m', 
        algorithm: 'RS256' 
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
