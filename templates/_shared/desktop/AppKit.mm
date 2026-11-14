#import <AppKit/AppKit.h>
#ifdef __cplusplus
#include "counter.hpp"
#endif

@interface AppDelegate : NSObject <NSApplicationDelegate>
@property (nonatomic, strong) NSWindow *window;
@property (nonatomic, strong) NSTextField *counterLabel;
@property (nonatomic) int count;
@end

@implementation AppDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    NSMenu *menu = [[NSMenu alloc] init];
    NSMenuItem *applicationMenu = [[NSMenuItem alloc] init];
    applicationMenu.submenu = [[NSMenu alloc] init];
    [applicationMenu.submenu addItemWithTitle:@"Quit __PROJECT_NAME__" action:@selector(terminate:) keyEquivalent:@"q"];
    [menu addItem:applicationMenu];
    NSApp.mainMenu = menu;

    NSRect frame = NSMakeRect(0, 0, 480, 280);
    NSWindowStyleMask style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskResizable;
    self.window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    self.window.title = @"__PROJECT_NAME__";
    self.counterLabel = [NSTextField labelWithString:@"Count: 0"];
    NSButton *increment = [NSButton buttonWithTitle:@"Add one" target:self action:@selector(addOne:)];
    NSStackView *controls = [NSStackView stackViewWithViews:@[self.counterLabel, increment]];
    controls.orientation = NSUserInterfaceLayoutOrientationVertical;
    controls.alignment = NSLayoutAttributeCenterX;
    controls.spacing = 12;
    controls.translatesAutoresizingMaskIntoConstraints = NO;
    NSView *content = self.window.contentView;
    [content addSubview:controls];
    [NSLayoutConstraint activateConstraints:@[
        [controls.centerXAnchor constraintEqualToAnchor:content.centerXAnchor],
        [controls.centerYAnchor constraintEqualToAnchor:content.centerYAnchor]
    ]];
    [self.window center];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
}

- (void)addOne:(id)sender {
#ifdef __cplusplus
    self.count = next_count(self.count);
#else
    self.count += 1;
#endif
    self.counterLabel.stringValue = [NSString stringWithFormat:@"Count: %d", self.count];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}
@end

int main(void) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        __attribute__((objc_precise_lifetime)) AppDelegate *delegate = [[AppDelegate alloc] init];
        app.delegate = delegate;
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        [app run];
    }
    return 0;
}
