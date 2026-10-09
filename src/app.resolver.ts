import { Query, Resolver } from '@nestjs/graphql';
import { Public } from './common/decorators/public.decorator';

@Resolver()
export class AppResolver {
  @Public()
  @Query(() => String)
  hello(): string {
    return 'Hello, World!';
  }
}
