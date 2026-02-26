import React from "react";

/* ADD FUNCTIONALITY TO SEARCH */

const SearchBar = () => {
  const handleSearch = () => {};

  return (
    <div
      className="border rounded-md 
"
    >
      <input
        type="text"
        placeholder="Search Here"
        className="w-48 sm:w-56 md:w-64 lg:w-80 px-2"
        onChange={handleSearch}
      />
    </div>
  );
};

export default SearchBar;
