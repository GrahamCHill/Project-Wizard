import javax.swing.JFrame
import javax.swing.JLabel
import javax.swing.SwingConstants
import javax.swing.SwingUtilities

fun main() {
    SwingUtilities.invokeLater {
        val window = JFrame("__PROJECT_NAME__")
        window.defaultCloseOperation = JFrame.EXIT_ON_CLOSE
        window.add(JLabel("__PROJECT_NAME__", SwingConstants.CENTER))
        window.setSize(480, 280)
        window.setLocationRelativeTo(null)
        window.isVisible = true
    }
}
