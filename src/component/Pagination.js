import React, { useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiCornerDownLeft
} from 'react-icons/fi';

/**
 * Industry-standard pagination component
 * @param {Object} props
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.totalRecords - Total number of records
 * @param {number} props.pageSize - Number of records per page
 * @param {Function} props.onPageChange - Callback when page changes
 * @param {Function} props.onPageSizeChange - Callback when page size changes (optional)
 * @param {Array<number>} props.pageSizeOptions - Available page size options (optional)
 * @param {boolean} props.showPageSizeSelector - Show page size dropdown (optional, default: true)
 * @param {boolean} props.showGoToPage - Show "Go to page" input (optional, default: true)
 */
function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  showGoToPage = true
}) {
  const [goToPageInput, setGoToPageInput] = useState('');
  const [inputError, setInputError] = useState(false);

  // Calculate the range of records being displayed
  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7; // Maximum number of page buttons to show

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the beginning
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          if (i > 1) pages.push(i);
        }
      } else {
        // In the middle
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const handleGoToPage = () => {
    const page = parseInt(goToPageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      handlePageChange(page);
      setGoToPageInput('');
      setInputError(false);
    } else {
      setInputError(true);
      setTimeout(() => setInputError(false), 2000);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setGoToPageInput(value);
    setInputError(false);
  };

  const handlePageSizeChange = (e) => {
    const newPageSize = parseInt(e.target.value, 10);
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize);
    }
  };

  const pageNumbers = getPageNumbers();

  const resultsLabel = (
    <>
      Showing <span className="font-semibold text-gray-900">{startRecord}</span> to{' '}
      <span className="font-semibold text-gray-900">{endRecord}</span> of{' '}
      <span className="font-semibold text-gray-900">{totalRecords}</span> results
      <span className="text-gray-300"> · </span>
      <span className="font-semibold text-gray-900">{totalPages}</span> {totalPages === 1 ? 'page' : 'pages'}
    </>
  );

  const renderPageSizeSelect = (id) => (
    <select
      id={id}
      aria-label="Rows per page"
      value={pageSize}
      onChange={handlePageSizeChange}
      className="h-8 rounded-md border border-gray-300 bg-white pl-2 pr-7 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {pageSizeOptions.map((size) => (
        <option key={size} value={size}>{size}</option>
      ))}
    </select>
  );

  const navButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:bg-white';

  if (totalPages <= 0 || totalRecords === 0) {
    return (
      <div className="bg-white border-t border-gray-200">
        <div className="px-4 py-2.5">
          <div className="text-sm text-gray-600 text-center">
            No results found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-t border-gray-200">
      <div className="px-4 py-2.5">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {resultsLabel}
            </div>

            {showPageSizeSelector && onPageSizeChange && (
              <div className="flex items-center gap-2">
                <label htmlFor="pageSize" className="text-sm text-gray-600 whitespace-nowrap">
                  Show:
                </label>
                {renderPageSizeSelect('pageSize')}
              </div>
            )}
          </div>

          {/* Center: Page Navigation */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className={navButtonClass}
              title="First page"
            >
              <FiChevronsLeft className="h-4 w-4" />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={navButtonClass}
              title="Previous page"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1 mx-2">
              {pageNumbers.map((page, index) => {
                if (page === '...') {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 py-1 text-gray-400 select-none"
                    >
                      •••
                    </span>
                  );
                }

                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`min-w-[2rem] h-8 px-2 rounded-md text-sm font-medium transition-all ${currentPage === page
                        ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                      }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={navButtonClass}
              title="Next page"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className={navButtonClass}
              title="Last page"
            >
              <FiChevronsRight className="h-4 w-4" />
            </button>
          </div>

          {/* Right: Go to Page */}
          {showGoToPage && (
            <div className="flex items-center gap-1.5">
              <input
                id="goToPage"
                type="number"
                min="1"
                max={totalPages}
                value={goToPageInput}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGoToPage();
                }}
                placeholder={`1-${totalPages}`}
                aria-label="Page number"
                className={`h-8 w-16 rounded-md border px-2 text-center text-sm focus:outline-none focus:ring-2 ${inputError
                  ? 'border-red-500 bg-red-50 focus:ring-red-500'
                  : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
              <button
                type="button"
                onClick={handleGoToPage}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Go to page"
              >
                <FiCornerDownLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Layout */}
        <div className="flex md:hidden flex-col gap-2">
          <div className="text-center text-sm text-gray-600">
            {resultsLabel}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Left Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className={navButtonClass}
                title="First page"
              >
                <FiChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={navButtonClass}
                title="Previous"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Current Page Display */}
            <div className="flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3">
              <span className="text-sm font-semibold text-indigo-600">{currentPage}</span>
              <span className="text-sm text-gray-400">/</span>
              <span className="text-sm font-semibold text-gray-700">{totalPages}</span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={navButtonClass}
                title="Next"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className={navButtonClass}
                title="Last page"
              >
                <FiChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Go to Page - Mobile */}
          {showGoToPage && (
            <div className="flex items-center justify-center gap-1.5">
              <input
                type="number"
                min="1"
                max={totalPages}
                value={goToPageInput}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGoToPage();
                }}
                placeholder={`1-${totalPages}`}
                aria-label="Page number"
                className={`h-8 w-16 rounded-md border px-2 text-center text-sm focus:outline-none focus:ring-2 ${inputError
                  ? 'border-red-500 bg-red-50 focus:ring-red-500'
                  : 'border-gray-300 bg-white focus:ring-indigo-500'
                }`}
              />
              <button
                type="button"
                onClick={handleGoToPage}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                title="Go to page"
              >
                <FiCornerDownLeft className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Page Size Selector - Mobile */}
          {showPageSizeSelector && onPageSizeChange && (
            <div className="flex items-center justify-center gap-2">
              <label htmlFor="pageSizeMobile" className="text-sm text-gray-600">Show:</label>
              {renderPageSizeSelect('pageSizeMobile')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Pagination;
