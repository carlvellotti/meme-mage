'use client';

import { useEffect, useRef } from 'react';

interface SpinningOrbProps {
  width?: number;
  height?: number;
  color?: {
    r: number;
    g: number;
    b: number;
  };
}

export default function SpinningOrb({ 
  width = 200, 
  height = 200,
  color = { r: 70, g: 140, b: 255 } // Default blue color
}: SpinningOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Configuration
    const sphereRad = width * 0.4;
    let radius_sp = 1;
    let particleList: any = {};
    let recycleBin: any = {};
    
    // Variables
    let displayWidth = width;
    let displayHeight = height;
    let timer: NodeJS.Timeout;
    let wait = 1;
    let count = wait - 1;
    let numToAddEachFrame = 8;
    let particleAlpha = 1;
    let fLen = 320;
    let projCenterX = displayWidth / 2;
    let projCenterY = displayHeight / 2;
    let zMax = fLen - 2;
    let turnAngle = 0;
    let turnSpeed = 2 * Math.PI / 1200;
    let sphereCenterX = 0;
    let sphereCenterY = 0;
    let sphereCenterZ = -3 - sphereRad;
    let particleRad = 2.5;
    let zeroAlphaDepth = -750;
    
    // Random acceleration factors
    let randAccelX = 0.1;
    let randAccelY = 0.1;
    let randAccelZ = 0.1;
    let gravity = 0;
    
    // Color
    const rgbString = `rgba(${color.r},${color.g},${color.b},`;
    
    function onTimer() {
      // Add new particles if enough time has elapsed
      count++;
      if (count >= wait) {
        count = 0;
        for (let i = 0; i < numToAddEachFrame; i++) {
          const theta = Math.random() * 2 * Math.PI;
          const phi = Math.acos(Math.random() * 2 - 1);
          const x0 = sphereRad * Math.sin(phi) * Math.cos(theta);
          const y0 = sphereRad * Math.sin(phi) * Math.sin(theta);
          const z0 = sphereRad * Math.cos(phi);
          
          // Add a new particle
          const p = addParticle(
            x0, 
            sphereCenterY + y0, 
            sphereCenterZ + z0, 
            0.002 * x0, 
            0.002 * y0, 
            0.002 * z0
          );
          
          // Set envelope parameters
          p.attack = 50;
          p.hold = 50;
          p.decay = 100;
          p.initValue = 0;
          p.holdValue = particleAlpha;
          p.lastValue = 0;
          
          // Stuck time
          p.stuckTime = 90 + Math.random() * 20;
          
          // Acceleration
          p.accelX = 0;
          p.accelY = gravity;
          p.accelZ = 0;
        }
      }
      
      // Update viewing angle
      turnAngle = (turnAngle + turnSpeed) % (2 * Math.PI);
      const sinAngle = Math.sin(turnAngle);
      const cosAngle = Math.cos(turnAngle);
      
      // Clear canvas - Add null check here
      if (context) {
        context.fillStyle = "rgba(0, 0, 0, 0)";
        context.clearRect(0, 0, displayWidth, displayHeight);
      
        // Update and draw particles
        let p = particleList.first;
        while (p != null) {
          // Record next particle before list is altered
          const nextParticle = p.next;
          
          // Update age
          p.age++;
          
          // If the particle is past its "stuck" time, it will begin to move
          if (p.age > p.stuckTime) {
            p.velX += p.accelX + randAccelX * (Math.random() * 2 - 1);
            p.velY += p.accelY + randAccelY * (Math.random() * 2 - 1);
            p.velZ += p.accelZ + randAccelZ * (Math.random() * 2 - 1);
            
            p.x += p.velX;
            p.y += p.velY;
            p.z += p.velZ;
          }
          
          // Calculate display coordinates
          const rotX = cosAngle * p.x + sinAngle * (p.z - sphereCenterZ);
          const rotZ = -sinAngle * p.x + cosAngle * (p.z - sphereCenterZ) + sphereCenterZ;
          const m = radius_sp * fLen / (fLen - rotZ);
          p.projX = rotX * m + projCenterX;
          p.projY = p.y * m + projCenterY;
          
          // Update alpha according to envelope parameters
          if (p.age < p.attack + p.hold + p.decay) {
            if (p.age < p.attack) {
              p.alpha = (p.holdValue - p.initValue) / p.attack * p.age + p.initValue;
            } else if (p.age < p.attack + p.hold) {
              p.alpha = p.holdValue;
            } else if (p.age < p.attack + p.hold + p.decay) {
              p.alpha = (p.lastValue - p.holdValue) / p.decay * (p.age - p.attack - p.hold) + p.holdValue;
            }
          } else {
            p.dead = true;
          }
          
          // Check if particle is still within viewable range
          let outsideTest = false;
          if (
            p.projX > displayWidth || 
            p.projX < 0 || 
            p.projY < 0 || 
            p.projY > displayHeight || 
            rotZ > zMax
          ) {
            outsideTest = true;
          }
          
          if (outsideTest || p.dead) {
            recycle(p);
          } else {
            // Depth-dependent darkening
            let depthAlphaFactor = (1 - rotZ / zeroAlphaDepth);
            depthAlphaFactor = depthAlphaFactor > 1 
              ? 1 
              : (depthAlphaFactor < 0 ? 0 : depthAlphaFactor);
            
            context.fillStyle = rgbString + depthAlphaFactor * p.alpha + ")";
            
            // Draw
            context.beginPath();
            context.arc(p.projX, p.projY, m * particleRad, 0, 2 * Math.PI, false);
            context.closePath();
            context.fill();
          }
          
          p = nextParticle;
        }
      }
    }
    
    function addParticle(x0: number, y0: number, z0: number, vx0: number, vy0: number, vz0: number) {
      let newParticle: any;
      
      // Check recycle bin for available particle
      if (recycleBin.first != null) {
        newParticle = recycleBin.first;
        // Remove from bin
        if (newParticle.next != null) {
          recycleBin.first = newParticle.next;
          newParticle.next.prev = null;
        } else {
          recycleBin.first = null;
        }
      } else {
        // Create a new particle
        newParticle = {};
      }
      
      // Add to beginning of particle list
      if (particleList.first == null) {
        particleList.first = newParticle;
        newParticle.prev = null;
        newParticle.next = null;
      } else {
        newParticle.next = particleList.first;
        particleList.first.prev = newParticle;
        particleList.first = newParticle;
        newParticle.prev = null;
      }
      
      // Initialize
      newParticle.x = x0;
      newParticle.y = y0;
      newParticle.z = z0;
      newParticle.velX = vx0;
      newParticle.velY = vy0;
      newParticle.velZ = vz0;
      newParticle.age = 0;
      newParticle.dead = false;
      newParticle.right = Math.random() < 0.5;
      
      return newParticle;
    }
    
    function recycle(p: any) {
      // Remove from particleList
      if (particleList.first === p) {
        if (p.next != null) {
          p.next.prev = null;
          particleList.first = p.next;
        } else {
          particleList.first = null;
        }
      } else {
        if (p.next == null) {
          p.prev.next = null;
        } else {
          p.prev.next = p.next;
          p.next.prev = p.prev;
        }
      }
      
      // Add to recycle bin
      if (recycleBin.first == null) {
        recycleBin.first = p;
        p.prev = null;
        p.next = null;
      } else {
        p.next = recycleBin.first;
        recycleBin.first.prev = p;
        recycleBin.first = p;
        p.prev = null;
      }
    }
    
    // Initialize
    particleList = {};
    recycleBin = {};
    
    // Start animation
    timer = setInterval(onTimer, 10);
    
    // Cleanup
    return () => {
      clearInterval(timer);
    };
  }, [width, height, color]);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="mx-auto"
    />
  );
} 