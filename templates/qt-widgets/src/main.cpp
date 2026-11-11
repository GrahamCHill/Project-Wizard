#include "starter.h"
#include <QApplication>
#include <QLabel>

int main(int argc, char *argv[])
{
    QApplication application(argc, argv);
    QLabel window(QStringLiteral("2 + 3 = %1").arg(starter_add(2, 3)));
    window.setWindowTitle(QStringLiteral("__PROJECT_NAME__"));
    window.setAlignment(Qt::AlignCenter);
    window.resize(480, 280);
    window.show();
    return application.exec();
}
