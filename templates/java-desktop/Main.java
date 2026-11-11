import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;

public class Main {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            JFrame window = new JFrame("__PROJECT_NAME__");
            window.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            window.add(new JLabel("__PROJECT_NAME__", SwingConstants.CENTER));
            window.setSize(480, 280);
            window.setLocationRelativeTo(null);
            window.setVisible(true);
        });
    }
}
