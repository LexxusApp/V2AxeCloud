declare module 'cloudflare:workers' {
  export class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    constructor(ctx: unknown, env: Env);
    readonly ctx: unknown;
    readonly env: Env;
    run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<unknown>;
  }

  export interface WorkflowStep {
    do<T>(name: string, callbackOrConfig: any, callback?: () => Promise<T>): Promise<T>;
    sleep(name: string, duration: string | number): Promise<void>;
    sleepUntil(name: string, timestamp: Date | number): Promise<void>;
  }

  export interface WorkflowEvent<Params = unknown> {
    payload: Params;
    timestamp: Date;
    instanceId: string;
  }
}
