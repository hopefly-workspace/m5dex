/**
 * Design System Examples
 * Demonstrates all design system components and utilities
 */

import React from 'react';

export const DesignSystemShowcase = () => {
  return (
    <div className="bg-primary min-h-screen p-lg">
      <div className="container">
        {/* Typography Examples */}
        <section className="section">
          <h1 className="text-display-xl mb-lg">Design System Showcase</h1>
          
          <div className="card mb-xl">
            <h2 className="text-h1 mb-md">Typography System</h2>
            
            <div className="mb-lg">
              <p className="text-display-xl mb-sm">Display XL - 48px Bold</p>
              <p className="text-display-lg mb-sm">Display LG - 36px Bold</p>
              <p className="text-display-md mb-sm">Display MD - 28px Bold</p>
              <p className="text-h1 mb-sm">Heading 1 - 24px Semibold</p>
              <p className="text-h2 mb-sm">Heading 2 - 20px Semibold</p>
              <p className="text-h3 mb-sm">Heading 3 - 18px Semibold</p>
              <p className="text-h4 mb-sm">Heading 4 - 16px Semibold</p>
            </div>

            <div className="mb-lg">
              <p className="text-body-lg mb-sm">Body Large - 16px Regular</p>
              <p className="text-body-md mb-sm">Body Medium - 14px Regular</p>
              <p className="text-body-sm mb-sm">Body Small - 12px Regular</p>
              <p className="text-body-xs mb-sm">Body XS - 10px Regular</p>
            </div>

            <div className="mb-lg">
              <p className="text-label-lg mb-sm">LABEL LARGE - 14px Medium Uppercase</p>
              <p className="text-label-md mb-sm">LABEL MEDIUM - 12px Medium Uppercase</p>
              <p className="text-label-sm mb-sm">LABEL SMALL - 10px Medium Uppercase</p>
            </div>

            <div className="mb-lg">
              <p className="text-number-xl font-mono mb-sm">32px 123,456.78</p>
              <p className="text-number-lg font-mono mb-sm">24px 123,456.78</p>
              <p className="text-number-md font-mono mb-sm">18px 123,456.78</p>
              <p className="text-number-sm font-mono mb-sm">14px 123,456.78</p>
            </div>
          </div>

          {/* Color Examples */}
          <div className="card mb-xl">
            <h2 className="text-h1 mb-md">Color Palette</h2>
            
            <div className="mb-lg">
              <h3 className="text-h3 mb-sm">Brand Colors</h3>
              <div className="flex gap-md mb-md">
                <div className="p-md rounded-md" style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}>
                  Primary
                </div>
                <div className="p-md rounded-md" style={{ backgroundColor: 'var(--brand-primary-light)', color: 'white' }}>
                  Primary Light
                </div>
                <div className="p-md rounded-md" style={{ backgroundColor: 'var(--brand-primary-dark)', color: 'white' }}>
                  Primary Dark
                </div>
              </div>
            </div>

            <div className="mb-lg">
              <h3 className="text-h3 mb-sm">Action Colors</h3>
              <div className="flex gap-md mb-md">
                <div className="p-md rounded-md" style={{ backgroundColor: 'var(--color-success)', color: 'white' }}>
                  Success
                </div>
                <div className="p-md rounded-md" style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}>
                  Danger
                </div>
                <div className="p-md rounded-md" style={{ backgroundColor: 'var(--color-warning)', color: 'white' }}>
                  Warning
                </div>
                <div className="p-md rounded-md" style={{ backgroundColor: 'var(--color-info)', color: 'white' }}>
                  Info
                </div>
              </div>
            </div>

            <div className="mb-lg">
              <h3 className="text-h3 mb-sm">Background Colors</h3>
              <div className="flex gap-md mb-md">
                <div className="p-md rounded-md bg-primary border border-light">
                  Primary BG
                </div>
                <div className="p-md rounded-md bg-secondary border border-light">
                  Secondary BG
                </div>
                <div className="p-md rounded-md bg-tertiary border border-light">
                  Tertiary BG
                </div>
                <div className="p-md rounded-md bg-elevated border border-light">
                  Elevated BG
                </div>
              </div>
            </div>

            <div className="mb-lg">
              <h3 className="text-h3 mb-sm">Text Colors</h3>
              <div className="flex flex-col gap-sm">
                <p className="text-primary">Primary Text - #FFFFFF</p>
                <p className="text-secondary">Secondary Text - #B0B8C8</p>
                <p className="text-tertiary">Tertiary Text - #6B7280</p>
                <p className="text-link">Link Text - #0066FF</p>
                <p className="text-success">Success Text - #00C853</p>
                <p className="text-danger">Danger Text - #FF3D00</p>
              </div>
            </div>
          </div>

          {/* Spacing Examples */}
          <div className="card mb-xl">
            <h2 className="text-h1 mb-md">Spacing System</h2>
            
            <div className="mb-lg">
              <div className="mb-sm" style={{ width: 'var(--space-xs)', height: '20px', backgroundColor: 'var(--brand-primary)' }}></div>
              <span className="text-body-sm">XS - 4px</span>
            </div>
            <div className="mb-lg">
              <div className="mb-sm" style={{ width: 'var(--space-sm)', height: '20px', backgroundColor: 'var(--brand-primary)' }}></div>
              <span className="text-body-sm">SM - 8px</span>
            </div>
            <div className="mb-lg">
              <div className="mb-sm" style={{ width: 'var(--space-md)', height: '20px', backgroundColor: 'var(--brand-primary)' }}></div>
              <span className="text-body-sm">MD - 16px</span>
            </div>
            <div className="mb-lg">
              <div className="mb-sm" style={{ width: 'var(--space-lg)', height: '20px', backgroundColor: 'var(--brand-primary)' }}></div>
              <span className="text-body-sm">LG - 24px</span>
            </div>
            <div className="mb-lg">
              <div className="mb-sm" style={{ width: 'var(--space-xl)', height: '20px', backgroundColor: 'var(--brand-primary)' }}></div>
              <span className="text-body-sm">XL - 32px</span>
            </div>
          </div>

          {/* Border Radius Examples */}
          <div className="card mb-xl">
            <h2 className="text-h1 mb-md">Border Radius</h2>
            
            <div className="flex gap-md items-center mb-md">
              <div className="p-md rounded-sm" style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}>SM - 4px</div>
              <div className="p-md rounded-md" style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}>MD - 8px</div>
              <div className="p-md rounded-lg" style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}>LG - 12px</div>
              <div className="p-md rounded-xl" style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}>XL - 16px</div>
              <div className="p-md rounded-2xl" style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}>2XL - 24px</div>
              <div className="p-md rounded-full" style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}>Full</div>
            </div>
          </div>

          {/* Component Examples */}
          <div className="card mb-xl">
            <h2 className="text-h1 mb-md">Components</h2>
            
            <div className="mb-lg">
              <h3 className="text-h3 mb-sm">Buttons</h3>
              <div className="flex gap-md flex-wrap">
                <button className="btn btn-primary">Primary</button>
                <button className="btn btn-success">Success</button>
                <button className="btn btn-danger">Danger</button>
                <button className="btn btn-outline">Outline</button>
                <button className="btn btn-ghost">Ghost</button>
              </div>
            </div>

            <div className="mb-lg">
              <h3 className="text-h3 mb-sm">Button Sizes</h3>
              <div className="flex gap-md items-center">
                <button className="btn btn-primary btn-sm">Small</button>
                <button className="btn btn-primary">Default</button>
                <button className="btn btn-primary btn-lg">Large</button>
              </div>
            </div>

            <div className="mb-lg">
              <h3 className="text-h3 mb-sm">Inputs</h3>
              <div className="flex flex-col gap-md" style={{ maxWidth: '400px' }}>
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" className="input" placeholder="Enter your email" />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" className="input" placeholder="Enter your password" />
                </div>
                <div>
                  <label className="label">Error State</label>
                  <input type="text" className="input input-error" placeholder="This field has an error" />
                </div>
              </div>
            </div>

            <div className="mb-lg">
              <h3 className="text-h3 mb-sm">Badges</h3>
              <div className="flex gap-md">
                <span className="badge badge-success">Success</span>
                <span className="badge badge-danger">Danger</span>
                <span className="badge badge-warning">Warning</span>
                <span className="badge badge-info">Info</span>
              </div>
            </div>
          </div>

          {/* Shadow Examples */}
          <div className="card mb-xl">
            <h2 className="text-h1 mb-md">Shadows</h2>
            
            <div className="flex gap-md">
              <div className="p-lg bg-secondary rounded-lg shadow-sm">Shadow SM</div>
              <div className="p-lg bg-secondary rounded-lg shadow-md">Shadow MD</div>
              <div className="p-lg bg-secondary rounded-lg shadow-lg">Shadow LG</div>
              <div className="p-lg bg-secondary rounded-lg shadow-xl">Shadow XL</div>
              <div className="p-lg bg-secondary rounded-lg shadow-glow">Shadow Glow</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DesignSystemShowcase;

