-- The C# app passes the current position and elapsed ticks through C++.
local speed = 3

function update(position, ticks)
    return (position + speed * ticks) % 100
end
