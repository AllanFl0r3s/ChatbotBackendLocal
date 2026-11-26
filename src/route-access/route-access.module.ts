import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { RouteAccessService } from './route-access.service';

@Module({ imports: [TypeOrmModule.forFeature([User])], providers: [RouteAccessService], exports: [RouteAccessService] })
export class RouteAccessModule {}
