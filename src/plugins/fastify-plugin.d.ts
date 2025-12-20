declare module 'fastify-plugin' {
  import { type FastifyPluginCallback, type FastifyPluginAsync } from 'fastify';
  export default function fp<T extends FastifyPluginCallback | FastifyPluginAsync>(plugin: T): T;
}
