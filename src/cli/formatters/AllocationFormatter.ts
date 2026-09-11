import { AllocationHistoryRecord } from '../../domain/repositories/IAllocationHistoryRepository';

export class AllocationFormatter {
  static format(records: AllocationHistoryRecord[]): string {
    const headers = [
      'ID',
      'Allocation ID',
      'Requested',
      'Strategy',
      'Type',
      'Source',
      'Provided',
      'Cost',
      'Created At',
    ];
    const values = records.map((record) => [
      String(record.id),
      String(record.allocationId),
      String(record.hoursRequested),
      record.strategyName,
      record.type,
      record.source,
      String(record.totalHoursProvided),
      `$${record.totalCost}`,
      record.createdAt,
    ]);
    const widths = headers.map((header, index) =>
      Math.max(header.length, ...values.map((row) => row[index].length)),
    );
    const separator = `+-${widths.map((width) => '-'.repeat(width)).join('-+-')}-+`;
    const row = (columns: string[]): string =>
      `| ${columns.map((value, index) => value.padEnd(widths[index])).join(' | ')} |`;

    return [
      '=== Allocation History ===',
      separator,
      row(headers),
      separator,
      ...(values.length > 0 ? values.map(row) : []),
      separator,
    ].join('\n');
  }
}
