import { Global, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import {
  createRedisClient,
  destroyRedisClient,
  REDIS_CLIENT,
  type RedisClient,
} from './redis.client';

/** Holds the live client so the module can quit it on shutdown. */
let activeClient: RedisClient | null = null;

async function redisClientFactory(): Promise<RedisClient | null> {
  const client = await createRedisClient();
  activeClient = client;
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: redisClientFactory,
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  async onModuleDestroy(): Promise<void> {
    const client = activeClient;
    activeClient = null;
    if (client) {
      this.logger.log('Disconnecting Redis');
      await destroyRedisClient(client);
    }
  }
}
