"use client";

import { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/ui/cn";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from "@/lib/ui/icons";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<TData>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  pageSize = 10,
  isLoading = false,
  emptyMessage = "No results found.",
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(searchKey ? { columnFilters: [{ id: searchKey, value: globalFilter }] } : {}),
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;

  return (
    <div className="space-y-4">
      {searchKey && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-left font-medium text-muted-foreground",
                        sortable && "cursor-pointer select-none",
                      )}
                      onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {sortable && sorted === "asc" && <ChevronUp className="h-4 w-4" />}
                        {sortable && sorted === "desc" && <ChevronDown className="h-4 w-4" />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.length > 0
                ? table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-muted/50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-foreground">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                : (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className={cn(
                "inline-flex min-h-10 items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm transition-colors",
                "text-foreground hover:bg-muted/50",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className={cn(
                "inline-flex min-h-10 items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm transition-colors",
                "text-foreground hover:bg-muted/50",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
