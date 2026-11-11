local player = { x = 320, y = 180, radius = 16, speed = 220 }

function love.update(dt)
    local dx = (love.keyboard.isDown('right') and 1 or 0) - (love.keyboard.isDown('left') and 1 or 0)
    local dy = (love.keyboard.isDown('down') and 1 or 0) - (love.keyboard.isDown('up') and 1 or 0)
    local width, height = love.graphics.getDimensions()
    player.x = math.max(player.radius, math.min(width - player.radius, player.x + dx * player.speed * dt))
    player.y = math.max(player.radius, math.min(height - player.radius, player.y + dy * player.speed * dt))
end

function love.draw()
    love.graphics.clear(0.08, 0.12, 0.18)
    love.graphics.setColor(0.4, 0.85, 0.95)
    love.graphics.circle('fill', player.x, player.y, player.radius)
    love.graphics.setColor(1, 1, 1)
    love.graphics.print('Move with the arrow keys', 16, 16)
end
