import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let home = HomeController()
        let about = UIViewController()
        about.view.backgroundColor = .systemBackground
        let information = UILabel()
        information.text = "__PROJECT_NAME__"
        information.font = .preferredFont(forTextStyle: .title2)
        information.adjustsFontForContentSizeCategory = true
        information.numberOfLines = 0
        information.textAlignment = .center
        information.translatesAutoresizingMaskIntoConstraints = false
        about.view.addSubview(information)
        NSLayoutConstraint.activate([
            information.centerXAnchor.constraint(equalTo: about.view.centerXAnchor),
            information.centerYAnchor.constraint(equalTo: about.view.safeAreaLayoutGuide.centerYAnchor),
            information.leadingAnchor.constraint(greaterThanOrEqualTo: about.view.layoutMarginsGuide.leadingAnchor),
            information.trailingAnchor.constraint(lessThanOrEqualTo: about.view.layoutMarginsGuide.trailingAnchor)
        ])
        home.tabBarItem = UITabBarItem(title: "Home", image: UIImage(systemName: "house"), tag: 0)
        about.tabBarItem = UITabBarItem(title: "About", image: UIImage(systemName: "info.circle"), tag: 1)
        let tabs = UITabBarController()
        tabs.viewControllers = [home, about]
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = tabs
        self.window = window
        window.makeKeyAndVisible()
    }
}

final class HomeController: UIViewController {
    private var count = 0
    private let counter = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        counter.text = "Count: 0"
        counter.font = .preferredFont(forTextStyle: .title2)
        counter.adjustsFontForContentSizeCategory = true
        let increment = UIButton(type: .system)
        increment.setTitle("Add one", for: .normal)
        increment.addTarget(self, action: #selector(addOne), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [counter, increment])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor)
        ])
    }

    @objc private func addOne() {
        count += 1
        counter.text = "Count: \(count)"
    }
}
