import React, { useState } from 'react';
import SearchableSelect from './SearchableSelect';
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

  if (totalPages <= 0 || totalRecords === 0) {
    return (
      <div className="bg-white border-t border-gray-200">
        <div className="px-4 py-4">
          <div className="text-sm text-gray-600 text-center">
            No results found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-t border-gray-200">
      {/* Main Pagination Container */}
      <div className="px-4 py-4">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between gap-6">
          {/* Left: Records Info & Page Size */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700 font-medium">
              Showing <span className="text-gray-900 font-semibold">{startRecord}</span> to{' '}
              <span className="text-gray-900 font-semibold">{endRecord}</span> of{' '}
              <span className="text-gray-900 font-semibold">{totalRecords}</span> results
            </div>

            {showPageSizeSelector && onPageSizeChange && (
              <div className="flex items-center gap-2 ml-2">
                <label htmlFor="pageSize" className="text-sm text-gray-600 whitespace-nowrap">
                  Show:
                </label>
                <SearchableSelect
                  id="pageSize"
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  options={pageSizeOptions.map((size) => ({ value: size, label: String(size) }))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Center: Page Navigation */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 transition-all"
              title="First page"
            >
              <FiChevronsLeft className="h-4 w-4" />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 transition-all"
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
                    className={`min-w-[2.5rem] h-9 px-3 rounded-md text-sm font-medium transition-all ${
                      currentPage === page
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
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 transition-all"
              title="Next page"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 transition-all"
              title="Last page"
            >
              <FiChevronsRight className="h-4 w-4" />
            </button>
          </div>

          {/* Right: Go to Page */}
          {showGoToPage && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                <label htmlFor="goToPage" className="text-sm text-gray-600 whitespace-nowrap font-medium">
                  Go to:
                </label>
                <div className="relative">
                  <input
                    id="goToPage"
                    type="number"
                    min="1"
                    max={totalPages}
                    value={goToPageInput}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleGoToPage();
                      }
                    }}
                    placeholder={`1-${totalPages}`}
                    className={`w-20 px-2 py-1.5 border rounded-md text-sm text-center focus:outline-none focus:ring-2 transition-all ${
                      inputError
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white'
                    }`}
                  />
                </div>
                <button
                  onClick={handleGoToPage}
                  className="p-1.5 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                  title="Go to page"
                >
                  <FiCornerDownLeft className="h-4 w-4" />
                </button>
              </div>
              <div className="text-xs text-gray-500">
                of <span className="font-semibold text-gray-700">{totalPages}</span> pages
              </div>
            </div>
          )}
        </div>

        {/* Mobile Layout */}
        <div className="flex md:hidden flex-col gap-4">
          {/* Records Info */}
          <div className="text-sm text-gray-700 text-center">
            <span className="font-medium">{startRecord}-{endRecord}</span> of{' '}
            <span className="font-semibold">{totalRecords}</span> results
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Left Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="First page"
              >
                <FiChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Previous"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Current Page Display */}
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
              <span className="text-sm text-gray-600">Page</span>
              <span className="text-base font-bold text-indigo-600">{currentPage}</span>
              <span className="text-sm text-gray-400">of</span>
              <span className="text-sm font-semibold text-gray-700">{totalPages}</span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Next"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Last page"
              >
                <FiChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Go to Page - Mobile */}
          {showGoToPage && (
            <div className="flex items-center justify-center gap-2">
              <input
                type="number"
                min="1"
                max={totalPages}
                value={goToPageInput}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleGoToPage();
                  }
                }}
                placeholder={`1-${totalPages}`}
                className={`w-24 px-3 py-2 border rounded-md text-sm text-center focus:outline-none focus:ring-2 transition-all ${
                  inputError
                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                    : 'border-gray-300 focus:ring-indigo-500 bg-white'
                }`}
              />
              <button
                onClick={handleGoToPage}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Go
              </button>
            </div>
          )}

          {/* Page Size Selector - Mobile */}
          {showPageSizeSelector && onPageSizeChange && (
            <div className="flex items-center justify-center gap-2">
              <label className="text-sm text-gray-600">Show:</label>
              <SearchableSelect
                value={pageSize}
                onChange={handlePageSizeChange}
                options={pageSizeOptions.map((size) => ({ value: size, label: `${size} per page` }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Pagination;
