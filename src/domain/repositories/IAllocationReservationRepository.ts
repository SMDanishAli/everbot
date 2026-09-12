import { RobotSource } from '../entities/Robot';

export interface IAllocationReservationRepository {
  allocate(
    selections: Array<{ type: string; source: RobotSource; count: number }>,
  ): Promise<void>;
}
