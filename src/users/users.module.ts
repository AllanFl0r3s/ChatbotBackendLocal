import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RouteAccessModule } from '../route-access/route-access.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RouteAccessModule],
  controllers: [UsersController],
  providers: [UsersService, AdminGuard],
  exports: [UsersService],
})
export class UsersModule {}
