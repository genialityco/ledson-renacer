import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import type { UserCreate, UserUpdate } from './users.service';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/auth.guard';

@Roles('admin')
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  async create(@Body() data: UserCreate) {
    return this.usersService.create(data);
  }

  @Put(':uid')
  async update(
    @Param('uid') uid: string,
    @Body() data: UserUpdate,
    @Req() req: AuthedRequest,
  ) {
    return this.usersService.update(uid, data, req.user?.uid ?? '');
  }
}
